import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DeviceCertificate } from '../entities/device-certificate.entity';
import { DeviceRegistration } from '../entities/device-registration.entity';
import { DeviceRegistryService } from './device-registry.service';

interface DemoCertificate {
  certificate: string;
  privateKey: string;
  fingerprint: string;
}

export interface CertificateBundle {
  deviceCertificate: string;
  privateKey: string;
  caCertificate: string;
  fingerprint: string;
}

@Injectable()
export class CertificateService implements OnModuleInit {
  private readonly logger = new Logger(CertificateService.name);
  private caCertificate: string;
  private caPrivateKey: string;

  constructor(
    @InjectRepository(DeviceCertificate)
    private readonly certificateRepository: Repository<DeviceCertificate>,
    private readonly deviceRegistryService: DeviceRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeDemoCA();
  }

  private async initializeDemoCA(): Promise<void> {
    this.logger.log('Initializing demo CA...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    const caSubject = '/CN=DROPS-UTM-Demo-CA/O=DROPS-UTM/C=US';
    const notBefore = new Date();
    const notAfter = new Date(notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);

    this.caCertificate = this.generateSelfSignedCertPem(
      publicKey,
      privateKey,
      caSubject,
      notBefore,
      notAfter,
      true,
    );

    this.caPrivateKey = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();

    this.logger.log('Demo CA initialized successfully');
  }

  private generateSelfSignedCertPem(
    publicKey: crypto.KeyObject,
    privateKey: crypto.KeyObject,
    subject: string,
    notBefore: Date,
    notAfter: Date,
    isCA: boolean,
  ): string {
    const serialNumber = crypto.randomBytes(16).toString('hex');
    const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    const pubKeyBase64 = pubKeyDer.toString('base64');

    const certData = {
      version: 3,
      serialNumber,
      subject,
      issuer: subject,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      publicKey: pubKeyBase64,
      isCA,
    };

    const certJson = JSON.stringify(certData);
    const signature = crypto.sign('sha256', Buffer.from(certJson), privateKey);

    const certContent = Buffer.concat([
      Buffer.from(certJson),
      Buffer.from('|'),
      signature,
    ]).toString('base64');

    return `-----BEGIN CERTIFICATE-----\n${this.wrapBase64(certContent)}-----END CERTIFICATE-----\n`;
  }

  private wrapBase64(base64: string, lineLength = 64): string {
    const lines: string[] = [];
    for (let i = 0; i < base64.length; i += lineLength) {
      lines.push(base64.slice(i, i + lineLength));
    }
    return lines.join('\n') + '\n';
  }

  private computeFingerprint(certPem: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(certPem);
    return hash.digest('hex').toUpperCase();
  }

  async generateDeviceCertificate(
    registrationId: string,
  ): Promise<CertificateBundle> {
    const registration = await this.deviceRegistryService.findById(registrationId);

    const existingCert = await this.certificateRepository.findOne({
      where: { deviceRegistrationId: registrationId, revokedAt: null as any },
      order: { issuedAt: 'DESC' },
    });

    if (existingCert) {
      await this.revokeCertificate(existingCert.id);
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    const commonName = `device-${registration.deviceIdentifier}`;
    const subject = `/CN=${commonName}/O=DROPS-UTM-Devices`;

    const notBefore = new Date();
    const notAfter = new Date(notBefore.getTime() + 90 * 24 * 60 * 60 * 1000);

    const deviceCertPem = this.generateDeviceCertPem(
      publicKey,
      commonName,
      notBefore,
      notAfter,
    );

    const fingerprint = this.computeFingerprint(deviceCertPem);

    const certificate = this.certificateRepository.create({
      deviceRegistrationId: registrationId,
      certificatePem: deviceCertPem,
      fingerprint,
      commonName,
      issuedAt: notBefore,
      expiresAt: notAfter,
    });

    await this.certificateRepository.save(certificate);

    await this.deviceRegistryService.updateRegistrationStatus(registrationId, 'active');

    const privateKeyPem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();

    return {
      deviceCertificate: deviceCertPem,
      privateKey: privateKeyPem,
      caCertificate: this.caCertificate,
      fingerprint,
    };
  }

  private generateDeviceCertPem(
    publicKey: crypto.KeyObject,
    commonName: string,
    notBefore: Date,
    notAfter: Date,
  ): string {
    const serialNumber = crypto.randomBytes(16).toString('hex');
    const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    const pubKeyBase64 = pubKeyDer.toString('base64');

    const certData = {
      version: 3,
      serialNumber,
      subject: `/CN=${commonName}/O=DROPS-UTM-Devices`,
      issuer: '/CN=DROPS-UTM-Demo-CA/O=DROPS-UTM/C=US',
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      publicKey: pubKeyBase64,
      isCA: false,
    };

    const certJson = JSON.stringify(certData);
    const signature = crypto.sign(
      'sha256',
      Buffer.from(certJson),
      crypto.createPrivateKey(this.caPrivateKey),
    );

    const certContent = Buffer.concat([
      Buffer.from(certJson),
      Buffer.from('|'),
      signature,
    ]).toString('base64');

    return `-----BEGIN CERTIFICATE-----\n${this.wrapBase64(certContent)}-----END CERTIFICATE-----\n`;
  }

  async validateCertificate(
    certPem: string,
  ): Promise<{ valid: boolean; deviceId?: string; error?: string }> {
    try {
      const fingerprint = this.computeFingerprint(certPem);

      const certificate = await this.certificateRepository.findOne({
        where: { fingerprint },
        relations: ['deviceRegistration'],
      });

      if (!certificate) {
        return { valid: false, error: 'Certificate not found' };
      }

      if (certificate.revokedAt) {
        return { valid: false, error: 'Certificate has been revoked' };
      }

      if (new Date() > certificate.expiresAt) {
        return { valid: false, error: 'Certificate has expired' };
      }

      if (certificate.deviceRegistration.registrationStatus !== 'active') {
        return { valid: false, error: 'Device registration is not active' };
      }

      return {
        valid: true,
        deviceId: certificate.deviceRegistrationId,
      };
    } catch (error) {
      return { valid: false, error: 'Certificate validation failed' };
    }
  }

  async validateCertificateByFingerprint(
    fingerprint: string,
  ): Promise<{ valid: boolean; registration?: DeviceRegistration; error?: string }> {
    try {
      const certificate = await this.certificateRepository.findOne({
        where: { fingerprint },
        relations: ['deviceRegistration'],
      });

      if (!certificate) {
        return { valid: false, error: 'Certificate not found' };
      }

      if (certificate.revokedAt) {
        return { valid: false, error: 'Certificate has been revoked' };
      }

      if (new Date() > certificate.expiresAt) {
        return { valid: false, error: 'Certificate has expired' };
      }

      const registration = certificate.deviceRegistration;
      if (registration.registrationStatus !== 'active') {
        return { valid: false, error: 'Device registration is not active' };
      }

      return {
        valid: true,
        registration,
      };
    } catch (error) {
      return { valid: false, error: 'Certificate validation failed' };
    }
  }

  getCACertificate(): string {
    return this.caCertificate;
  }

  async getCertificateByRegistration(
    registrationId: string,
  ): Promise<DeviceCertificate | null> {
    return this.certificateRepository.findOne({
      where: { deviceRegistrationId: registrationId, revokedAt: null as any },
      order: { issuedAt: 'DESC' },
    });
  }

  async revokeCertificate(certificateId: string): Promise<void> {
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate ${certificateId} not found`);
    }

    certificate.revokedAt = new Date();
    await this.certificateRepository.save(certificate);
  }

  async revokeCertificatesByRegistration(registrationId: string): Promise<void> {
    await this.certificateRepository.update(
      { deviceRegistrationId: registrationId, revokedAt: null as any },
      { revokedAt: new Date() },
    );
  }
}

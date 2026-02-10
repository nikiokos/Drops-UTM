import { create } from 'zustand';
import {
  templatesApi,
  CreateTemplateDto,
  UpdateTemplateDto,
  InstantiateTemplateDto,
  TemplateVariable,
  MissionBlueprint,
} from '@/lib/api';
import { Mission } from './missions.store';

export interface MissionTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  variables?: TemplateVariable[];
  blueprint: MissionBlueprint;
  version: number;
  isLatest: boolean;
  previousVersionId?: string;
  changelog?: string;
  usageCount: number;
  isPublished: boolean;
  publishedAt?: string;
  createdBy: string;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TemplatesState {
  templates: MissionTemplate[];
  selectedTemplate: MissionTemplate | null;
  templateVersions: MissionTemplate[];
  isLoading: boolean;
  error: string | null;

  // Template CRUD
  fetchTemplates: (params?: {
    category?: string;
    published?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchTemplate: (id: string) => Promise<MissionTemplate | null>;
  createTemplate: (data: CreateTemplateDto) => Promise<MissionTemplate | null>;
  updateTemplate: (id: string, data: UpdateTemplateDto) => Promise<MissionTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;

  // Versioning
  fetchVersions: (id: string) => Promise<void>;
  fetchVersion: (id: string, version: number) => Promise<MissionTemplate | null>;

  // Publishing
  publishTemplate: (id: string) => Promise<boolean>;
  unpublishTemplate: (id: string) => Promise<boolean>;

  // Instantiation
  instantiateTemplate: (id: string, data: InstantiateTemplateDto) => Promise<Mission | null>;

  // UI state
  selectTemplate: (template: MissionTemplate | null) => void;
  clearError: () => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  selectedTemplate: null,
  templateVersions: [],
  isLoading: false,
  error: null,

  fetchTemplates: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.getAll(params);
      set({ templates: response.data.data || response.data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch templates', isLoading: false });
      console.error('Failed to fetch templates:', error);
    }
  },

  fetchTemplate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.getById(id);
      const template = response.data;
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? template : t)),
        selectedTemplate: state.selectedTemplate?.id === id ? template : state.selectedTemplate,
        isLoading: false,
      }));
      return template;
    } catch (error) {
      set({ error: 'Failed to fetch template', isLoading: false });
      console.error('Failed to fetch template:', error);
      return null;
    }
  },

  createTemplate: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.create(data);
      const template = response.data;
      set((state) => ({
        templates: [template, ...state.templates],
        selectedTemplate: template,
        isLoading: false,
      }));
      return template;
    } catch (error) {
      set({ error: 'Failed to create template', isLoading: false });
      console.error('Failed to create template:', error);
      return null;
    }
  },

  updateTemplate: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.update(id, data);
      const template = response.data;
      // Update replaces the template with a new version, so we need to update the list
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? template : t)),
        selectedTemplate: template,
        isLoading: false,
      }));
      return template;
    } catch (error) {
      set({ error: 'Failed to update template', isLoading: false });
      console.error('Failed to update template:', error);
      return null;
    }
  },

  deleteTemplate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await templatesApi.delete(id);
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        selectedTemplate: state.selectedTemplate?.id === id ? null : state.selectedTemplate,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({ error: 'Failed to delete template', isLoading: false });
      console.error('Failed to delete template:', error);
      return false;
    }
  },

  fetchVersions: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.getVersions(id);
      set({ templateVersions: response.data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch template versions', isLoading: false });
      console.error('Failed to fetch template versions:', error);
    }
  },

  fetchVersion: async (id, version) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.getVersion(id, version);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: 'Failed to fetch template version', isLoading: false });
      console.error('Failed to fetch template version:', error);
      return null;
    }
  },

  publishTemplate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.publish(id);
      const template = response.data;
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? template : t)),
        selectedTemplate: state.selectedTemplate?.id === id ? template : state.selectedTemplate,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({ error: 'Failed to publish template', isLoading: false });
      console.error('Failed to publish template:', error);
      return false;
    }
  },

  unpublishTemplate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.unpublish(id);
      const template = response.data;
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? template : t)),
        selectedTemplate: state.selectedTemplate?.id === id ? template : state.selectedTemplate,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({ error: 'Failed to unpublish template', isLoading: false });
      console.error('Failed to unpublish template:', error);
      return false;
    }
  },

  instantiateTemplate: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await templatesApi.instantiate(id, data);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: 'Failed to create mission from template', isLoading: false });
      console.error('Failed to instantiate template:', error);
      return null;
    }
  },

  selectTemplate: (template) => {
    set({ selectedTemplate: template, templateVersions: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Template categories for filtering
export const TEMPLATE_CATEGORIES = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'mapping', label: 'Mapping' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'emergency', label: 'Emergency Response' },
  { value: 'custom', label: 'Custom' },
];

// Variable types for template creation
export const VARIABLE_TYPES = [
  { value: 'coordinate', label: 'Coordinate (lat/lng)' },
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'Text' },
  { value: 'hub', label: 'Hub Selection' },
  { value: 'drone', label: 'Drone Selection' },
];

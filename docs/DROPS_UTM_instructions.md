# Building DROPS UTM System with Claude - Step-by-Step Instructions

## Overview

This guide explains how to use Claude effectively to build the DROPS Smart Hubs Unmanned Traffic Management system. The system is complex and will require iterative development over multiple sessions.

## How to Use This Guide

1. **Start each session** by providing Claude with the main `DROPS_UTM_claude.md` file
2. **Be specific** about which component you want to work on
3. **Iterate** - Claude will build incrementally, test, and refine
4. **Provide feedback** on generated code and Claude will improve it
5. **Track progress** using the phase checklist in the main document

## Session Structure

### Starting a New Session

**Provide Context:**
```
I'm building the DROPS UTM system. Here's the main documentation:
[Attach DROPS_UTM_claude.md file]

Today I want to work on: [specific component/feature]
```

**Claude will:**
- Review the documentation
- Understand the context
- Ask clarifying questions
- Propose an implementation approach

### During Development

**Be clear about what you need:**
- "Create the database migration for the hubs table"
- "Implement the flight authorization algorithm"
- "Build the hub controller class with conflict detection"
- "Create the React component for the flight map"

**Claude will:**
- Generate code with proper structure
- Include error handling
- Add comments and documentation
- Suggest testing approaches

## Building the System: Recommended Order

### Stage 1: Foundation (Weeks 1-4)

#### Session 1: Project Setup
```
Create the project structure for DROPS UTM:
- Backend (NestJS)
- Frontend (Next.js)
- Mobile (Flutter)
- Database setup
- Docker configuration
```

**What Claude will create:**
- Project folder structure
- package.json files
- Docker Compose setup
- Environment configuration
- Git configuration

#### Session 2: Database Schema
```
Implement the PostgreSQL database schema for:
- Hubs
- Drones
- Flights
- Users
- Organizations

Create migrations and seed data.
```

**What Claude will create:**
- SQL migration files
- TypeORM/Prisma entities
- Seed data scripts
- Database connection setup

#### Session 3: Authentication System
```
Build the authentication and authorization system:
- JWT token generation
- Role-based access control
- User registration and login
- API key management for drones
```

**What Claude will create:**
- Auth service
- JWT strategy
- Guards and decorators
- Auth endpoints

#### Session 4: Basic API Structure
```
Create the REST API structure for:
- Hub management endpoints
- Drone registration endpoints
- User management endpoints
- Error handling middleware
- Request validation
```

**What Claude will create:**
- NestJS modules
- Controllers
- Service classes
- DTOs and validators
- Error filters

### Stage 2: Real-Time Tracking (Weeks 5-8)

#### Session 5: WebSocket Server
```
Implement the WebSocket server for real-time communication:
- Connection management
- Room-based subscriptions
- Event broadcasting
- Heartbeat mechanism
```

**What Claude will create:**
- WebSocket gateway
- Connection manager
- Event handlers
- Client authentication

#### Session 6: Telemetry Ingestion
```
Build the telemetry ingestion pipeline:
- Receive telemetry from drones
- Validate and normalize data
- Store in TimescaleDB
- Broadcast to subscribed clients
```

**What Claude will create:**
- Telemetry service
- Data validators
- Database writers
- WebSocket broadcasters

#### Session 7: MAVLink Adapter
```
Implement the MAVLink drone communication adapter:
- Connect to MAVLink drones
- Parse MAVLink messages
- Convert to standard telemetry format
- Send commands to drones
```

**What Claude will create:**
- MAVLink adapter class
- Message parsers
- Command translators
- Connection pooling

#### Session 8: DJI SDK Adapter
```
Implement the DJI SDK adapter:
- DJI SDK integration
- Telemetry parsing
- Command translation
- Event handling
```

**What Claude will create:**
- DJI adapter class
- SDK wrapper
- Data converters
- Error handlers

### Stage 3: Flight Management (Weeks 9-12)

#### Session 9: Flight Planning
```
Build the flight planning module:
- Route creation and validation
- Airspace checking
- Time slot scheduling
- Risk assessment
```

**What Claude will create:**
- Flight planning service
- Route validator
- Airspace checker
- Risk calculator

#### Session 10: Authorization Workflow
```
Implement the flight authorization system:
- Authorization request
- Automated checks
- Manual review workflow
- Approval/rejection logic
```

**What Claude will create:**
- Authorization service
- Workflow engine
- Notification system
- Decision logic

#### Session 11: Conflict Detection
```
Build the real-time conflict detection system:
- Position tracking
- Separation calculations
- Collision prediction
- Alert generation
```

**What Claude will create:**
- Conflict detection service
- Geometry calculations
- Prediction algorithms
- Alert dispatcher

#### Session 12: Conflict Resolution
```
Implement automated conflict resolution:
- Resolution strategy selection
- Altitude/speed/route adjustments
- Command execution
- Logging and notifications
```

**What Claude will create:**
- Resolution engine
- Strategy algorithms
- Command orchestrator
- Audit logger

### Stage 4: Hub Control System (Weeks 13-16)

#### Session 13: Hub Controller Core
```
Build the hub controller class:
- Airspace monitoring
- Flight queue management
- Capacity tracking
- Status reporting
```

**What Claude will create:**
- HubController class
- Monitoring loops
- Queue manager
- Status reporter

#### Session 14: Pre-Flight Checks
```
Implement automated pre-flight checks:
- Drone health verification
- Weather suitability
- Route clearance
- Pilot credentials
```

**What Claude will create:**
- Pre-flight service
- Check validators
- Weather integration
- Reporting system

#### Session 15: Launch Sequencing
```
Build the launch sequence controller:
- Takeoff slot management
- Launch commands
- Monitoring during takeoff
- Handoff to flight tracking
```

**What Claude will create:**
- Launch sequencer
- Slot scheduler
- Command sender
- Transition manager

#### Session 16: Hub-to-Central Sync
```
Implement synchronization with central command:
- Status updates
- Escalation handling
- Data synchronization
- Failover logic
```

**What Claude will create:**
- Sync service
- Escalation handler
- Data sync logic
- Failover controller

### Stage 5: Central Command (Weeks 17-20)

#### Session 17: Central Command Core
```
Build the central command controller:
- System-wide monitoring
- Hub coordination
- Emergency response
- Override capabilities
```

**What Claude will create:**
- CentralCommand class
- Monitoring system
- Coordinator
- Emergency handler

#### Session 18: Inter-Hub Flight Management
```
Implement inter-hub flight coordination:
- Responsibility transfer
- Route coordination
- Multi-hub authorization
- Handoff protocols
```

**What Claude will create:**
- Inter-hub service
- Transfer logic
- Handoff manager
- Protocol handlers

#### Session 19: System Analytics
```
Build system-wide analytics:
- Utilization metrics
- Performance tracking
- Pattern analysis
- Reporting
```

**What Claude will create:**
- Analytics service
- Metrics collectors
- Report generators
- Dashboard data API

#### Session 20: Emergency Response
```
Implement emergency response system:
- Emergency detection
- Response coordination
- Override commands
- Incident management
```

**What Claude will create:**
- Emergency coordinator
- Detection system
- Command executor
- Incident logger

### Stage 6: User Interfaces (Weeks 21-26)

#### Session 21: Central Dashboard - Map
```
Build the main map component:
- 3D airspace visualization
- Real-time flight positions
- Hub locations
- Conflict indicators
```

**What Claude will create:**
- React map component
- WebSocket integration
- 3D rendering
- Custom markers

#### Session 22: Central Dashboard - Status
```
Create status monitoring components:
- Hub status cards
- Active flights list
- System metrics
- Alert panel
```

**What Claude will create:**
- React components
- Real-time data hooks
- Status visualizations
- Alert UI

#### Session 23: Hub Operator Interface
```
Build the hub operator interface:
- Local airspace view
- Flight queue
- Authorization panel
- Drone status grid
```

**What Claude will create:**
- Hub operator app
- Local map view
- Queue manager UI
- Auth controls

#### Session 24: Pilot App - Flight Planning
```
Create flight planning screens (Flutter):
- Route planner
- Drone selection
- Time slot picker
- Pre-flight checklist
```

**What Claude will create:**
- Flutter screens
- Form widgets
- Map widget
- API integration

#### Session 25: Pilot App - In-Flight
```
Build in-flight monitoring screens:
- Real-time telemetry
- Map tracking
- Status indicators
- Emergency controls
```

**What Claude will create:**
- Flight screen
- Telemetry widgets
- Map integration
- Control buttons

#### Session 26: Manual Control Interface
```
Implement manual control features:
- Virtual joysticks
- Direct command sending
- Safety boundaries
- Status monitoring
```

**What Claude will create:**
- Control widgets
- Command senders
- Safety monitors
- Feedback UI

### Stage 7: Advanced Features (Weeks 27-30)

#### Session 27: Weather Integration
```
Integrate weather services:
- Real-time weather fetching
- Weather impact assessment
- Automatic restrictions
- Forecast analysis
```

**What Claude will create:**
- Weather service
- API integrations
- Impact calculator
- Alert generator

#### Session 28: Predictive Analytics
```
Build predictive features:
- Traffic prediction
- Conflict prediction
- Capacity forecasting
- Maintenance prediction
```

**What Claude will create:**
- Prediction models
- Analysis algorithms
- Forecast generators
- ML integration prep

#### Session 29: Regulatory Reporting
```
Implement compliance features:
- Automated reports
- CAA integration
- Flight log export
- Incident reporting
```

**What Claude will create:**
- Reporting service
- Export formatters
- Integration APIs
- Submission system

#### Session 30: Performance Optimization
```
Optimize system performance:
- Query optimization
- Caching strategy
- WebSocket optimization
- Load testing
```

**What Claude will create:**
- Optimized queries
- Cache layer
- Performance tests
- Monitoring setup

## Best Practices for Working with Claude

### 1. Provide Complete Context

**Good:**
```
I'm implementing the conflict detection system. Here's the database schema:
[paste relevant schema]

And here's the telemetry format we're using:
[paste telemetry structure]

I need the algorithm that checks for separation violations between two flights.
```

**Bad:**
```
Write conflict detection code.
```

### 2. Iterate and Refine

**First Request:**
```
Create the hub controller class with basic airspace monitoring.
```

**Follow-up:**
```
Good! Now add the flight queue management to the hub controller.
Can you also add error handling for when telemetry is unavailable?
```

### 3. Ask for Explanations

```
Can you explain how the conflict prediction algorithm works?
Why did you choose this approach for the separation calculation?
```

### 4. Request Testing

```
Create unit tests for the flight authorization service.
Include test cases for:
- Valid authorization
- Rejected due to airspace conflict
- Rejected due to weather
- Manual review required
```

### 5. Ask for Documentation

```
Add JSDoc comments to the conflict detection service.
Create a README for the drone adapter system explaining how to add new adapters.
```

### 6. Incremental Development

Break large features into smaller pieces:

**Instead of:**
```
Build the entire flight management system.
```

**Do this:**
```
Session 1: Create flight planning data structures
Session 2: Implement route validation
Session 3: Add airspace checking
Session 4: Build authorization workflow
Session 5: Add conflict detection integration
```

### 7. Integration Testing

```
Now that we have the hub controller and central command,
create integration tests that verify they communicate correctly.
Test the escalation flow when a high-severity conflict is detected.
```

## Common Patterns and Questions

### When Starting a Component

**Ask Claude:**
```
Before we implement the [component], can you:
1. Review the relevant sections from the claude.md
2. Propose a file structure
3. Identify dependencies we'll need
4. Suggest the implementation order
```

### When You're Stuck

**Tell Claude:**
```
I'm having trouble with [specific issue].
Here's what I've tried: [attempts]
Here's the error: [error message]
Can you help me debug this?
```

### When Integrating Components

**Request:**
```
We now have the hub controller and flight planning system.
Show me how to integrate them so that:
1. Flight plans are submitted to the hub
2. Hub validates and schedules them
3. Hub reports status back to the planning system
```

### When Optimizing

**Ask:**
```
The conflict detection is running slow with 50+ active flights.
Can you:
1. Profile the current implementation
2. Identify bottlenecks
3. Suggest optimizations
4. Implement the top 3 improvements
```

## File Organization Tips

### Keep Claude Informed of Structure

**Update Claude regularly:**
```
We've now created these files:
backend/
  src/
    modules/
      hub/
        hub.controller.ts
        hub.service.ts
        hub.entity.ts
      flight/
        flight.controller.ts
        flight.service.ts
        flight.entity.ts
    
The hub module is complete. Let's work on the flight module next.
```

### Use Consistent Naming

Tell Claude your conventions:
```
Use these naming conventions:
- Files: kebab-case (flight-authorization.service.ts)
- Classes: PascalCase (FlightAuthorizationService)
- Functions: camelCase (checkAirspaceConflict)
- Constants: UPPER_SNAKE_CASE (MAX_ALTITUDE_LIMIT)
```

## Testing Strategy

### Ask Claude to Generate Tests

```
Create Jest tests for the conflict detection service.
Include:
- Unit tests for separation calculation
- Integration tests with mock telemetry
- Edge cases (very close, same altitude, etc.)
- Performance tests (many simultaneous flights)
```

### Test-Driven Development

```
Before implementing the flight authorization logic,
create the test cases first. Then implement the logic
to make the tests pass.
```

## Documentation

### API Documentation

```
Generate OpenAPI documentation for the flight management endpoints.
Include request/response examples and error codes.
```

### Code Comments

```
Add inline comments explaining:
- Why we use this specific separation distance
- How the prediction algorithm works
- Edge cases being handled
```

### README Files

```
Create a README for the drone adapter system that explains:
- Purpose and architecture
- How to add a new adapter
- Available adapter types
- Example usage
```

## Deployment

### Docker Configuration

```
Create Docker configuration for:
- Backend API service
- Frontend service
- Database
- Redis
- TimescaleDB

Include docker-compose.yml for local development.
```

### Environment Setup

```
Create environment variable documentation:
- Required variables
- Optional variables with defaults
- Example .env file
- Security considerations
```

## Troubleshooting

### Common Issues

**Database Connection:**
```
I'm getting database connection errors.
Here's my environment config: [config]
What am I missing?
```

**WebSocket Not Connecting:**
```
WebSocket clients can't connect to the server.
Here's the server code: [code]
And the client code: [code]
```

**Real-time Updates Not Working:**
```
Telemetry updates aren't being broadcast to connected clients.
Here's the broadcast code: [code]
The data is being saved to database correctly.
```

## Version Control

### Git Workflow

```
What Git branching strategy should we use for this project?
Should we use feature branches for each component?
```

### Commit Messages

```
Generate appropriate commit messages for:
- The hub controller implementation
- The conflict detection system
- The database schema updates
```

## Progress Tracking

### Use the Checklist

Regularly update the phase checklist in the main document:

```
We've completed:
- [x] Database schema implementation
- [x] Basic API structure
- [x] Authentication system
- [ ] Flight planning module (in progress)

What should we focus on next?
```

### Regular Reviews

```
We've been building for 2 weeks. Can you:
1. Review what we've built so far
2. Check alignment with the original plan
3. Suggest any architectural improvements
4. Identify potential issues early
```

## Advanced Usage

### Architecture Reviews

```
Review the overall architecture we've built.
Are there any:
- Bottlenecks
- Single points of failure
- Security concerns
- Scalability issues
```

### Performance Optimization

```
Analyze the performance of:
- Database queries under load
- WebSocket message throughput
- Conflict detection speed
- Memory usage

Suggest optimizations for each.
```

### Security Audit

```
Perform a security review of:
- Authentication and authorization
- API endpoints
- Data encryption
- Drone command security
- User input validation
```

## Final Notes

### Remember:
1. **Break down complexity** - Take it one component at a time
2. **Test as you go** - Don't wait until the end
3. **Document everything** - You'll thank yourself later
4. **Ask questions** - Claude is here to help
5. **Iterate** - First version doesn't have to be perfect
6. **Review regularly** - Step back and assess progress

### When You're Ready for Production:
```
We're ready to deploy to production. Help me:
1. Create deployment checklist
2. Set up monitoring and alerts
3. Plan rollout strategy
4. Create runbooks for operations team
5. Document disaster recovery procedures
```

### Continuous Improvement:
```
Based on the production metrics we're seeing,
suggest improvements for:
- Performance
- User experience
- Reliability
- Cost efficiency
```

---

## Quick Reference Commands

### Start New Feature
```
I want to implement [feature] from the claude.md.
Let's start by reviewing the requirements and proposing an implementation plan.
```

### Debug Issue
```
I'm having an issue with [component].
Error: [error message]
Code: [relevant code]
What's wrong and how do I fix it?
```

### Review and Refactor
```
Review the [component] implementation.
Suggest improvements for:
- Code quality
- Performance
- Maintainability
- Security
```

### Create Tests
```
Create comprehensive tests for [component]:
- Unit tests
- Integration tests
- Edge cases
- Performance tests
```

### Generate Documentation
```
Create documentation for [component]:
- API documentation
- Code comments
- Usage examples
- Troubleshooting guide
```

---

Remember: Building a system this complex is a marathon, not a sprint. Work systematically through the stages, test thoroughly, and don't hesitate to ask Claude for help at any point!

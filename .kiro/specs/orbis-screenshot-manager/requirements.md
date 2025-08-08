# Requirements Document

## Introduction

Orbis is a local web-based tool for managing website screenshot targets and taking automated screenshots using Playwright. The application provides a clean interface for managing multiple websites, handling authentication for login-required sites, and automatically capturing screenshots with organized storage. The system is designed to run locally on macOS with SQLite for data persistence and environment-based credential management for security.

## Requirements

### Requirement 1

**User Story:** As a user, I want to manage screenshot targets through a web interface, so that I can easily add, edit, and delete websites I want to capture screenshots from.

#### Acceptance Criteria

1. WHEN I access the web interface THEN the system SHALL display a dashboard with all configured screenshot targets
2. WHEN I click "Add Target" THEN the system SHALL open a form to create a new screenshot target
3. WHEN I fill in target details and submit THEN the system SHALL save the target to the database
4. WHEN I click edit on an existing target THEN the system SHALL open a pre-populated form for editing
5. WHEN I click delete on a target THEN the system SHALL prompt for confirmation and remove the target if confirmed
6. WHEN no targets exist THEN the system SHALL display an empty state with guidance to add the first target

### Requirement 2

**User Story:** As a user, I want to configure multiple URLs per target, so that I can capture screenshots from different pages of the same website or application.

#### Acceptance Criteria

1. WHEN creating or editing a target THEN the system SHALL allow me to add multiple URLs with descriptive names
2. WHEN I add a URL THEN the system SHALL require both a name and valid URL
3. WHEN I remove a URL THEN the system SHALL update the target configuration immediately
4. WHEN I save a target THEN the system SHALL validate that at least one URL is configured
5. IF no URLs are configured THEN the system SHALL prevent saving and display an error message

### Requirement 3

**User Story:** As a user, I want to configure authentication for login-required websites, so that I can capture screenshots from protected areas of applications.

#### Acceptance Criteria

1. WHEN creating a target THEN the system SHALL provide a toggle for "Requires Login"
2. WHEN login is enabled THEN the system SHALL show additional fields for login configuration
3. WHEN configuring login THEN the system SHALL require login URL, CSS selectors for username/password/submit fields
4. WHEN configuring credentials THEN the system SHALL use environment variable keys rather than storing passwords directly
5. IF login is required but configuration is incomplete THEN the system SHALL prevent screenshot capture and show appropriate error

### Requirement 4

**User Story:** As a user, I want to run screenshot captures for all or selected targets, so that I can generate up-to-date screenshots of my configured websites.

#### Acceptance Criteria

1. WHEN I click "Run Screenshots" THEN the system SHALL capture screenshots for all configured targets
2. WHEN screenshot capture starts THEN the system SHALL show progress indication and disable the run button
3. WHEN screenshots are complete THEN the system SHALL display a summary of successful and failed captures
4. WHEN login is required THEN the system SHALL authenticate before capturing screenshots
5. IF authentication fails THEN the system SHALL report the failure and continue with other targets

### Requirement 5

**User Story:** As a user, I want screenshots to be automatically organized and stored, so that I can easily find and review captured images.

#### Acceptance Criteria

1. WHEN screenshots are captured THEN the system SHALL organize them in date-based folders (YYYY-MM-DD)
2. WHEN saving screenshots THEN the system SHALL use descriptive filenames including target name, URL name, and timestamp
3. WHEN multiple URLs exist for a target THEN the system SHALL capture screenshots for each URL
4. WHEN screenshots are saved THEN the system SHALL use PNG format with full-page capture
5. IF screenshot directory doesn't exist THEN the system SHALL create it automatically

### Requirement 6

**User Story:** As a user, I want to preview recent screenshots directly in the interface, so that I can quickly verify captures without navigating to file system.

#### Acceptance Criteria

1. WHEN viewing the dashboard THEN the system SHALL show thumbnail previews of the latest screenshots for each target
2. WHEN I click on a screenshot preview THEN the system SHALL open a modal with full-size images
3. WHEN multiple screenshots exist from the latest session THEN the system SHALL show all images from that session
4. WHEN no screenshots exist THEN the system SHALL show a placeholder icon
5. IF screenshot files are missing THEN the system SHALL handle the error gracefully and show appropriate message

### Requirement 7

**User Story:** As a user, I want secure credential management, so that my login information is protected and not stored in the database.

#### Acceptance Criteria

1. WHEN configuring login credentials THEN the system SHALL only store environment variable key names
2. WHEN running screenshots THEN the system SHALL read actual credentials from environment variables
3. WHEN credentials are missing THEN the system SHALL report clear error messages
4. WHEN the application starts THEN the system SHALL never log or display actual credential values
5. IF environment variables are not set THEN the system SHALL prevent login attempts and show configuration guidance

### Requirement 8

**User Story:** As a user, I want reliable data persistence, so that my target configurations are preserved across application restarts.

#### Acceptance Criteria

1. WHEN I create or modify targets THEN the system SHALL persist changes to SQLite database immediately
2. WHEN the application starts THEN the system SHALL load all existing targets from the database
3. WHEN database schema changes are needed THEN the system SHALL migrate existing data automatically
4. WHEN database operations fail THEN the system SHALL show appropriate error messages
5. IF the database file doesn't exist THEN the system SHALL create it with proper schema

### Requirement 9

**User Story:** As a user, I want the application to handle errors gracefully, so that I can understand and resolve issues when they occur.

#### Acceptance Criteria

1. WHEN network errors occur during screenshot capture THEN the system SHALL report specific error messages
2. WHEN browser automation fails THEN the system SHALL continue with remaining targets and report failures
3. WHEN file system operations fail THEN the system SHALL show clear error messages with suggested actions
4. WHEN database operations fail THEN the system SHALL prevent data corruption and show recovery options
5. IF unexpected errors occur THEN the system SHALL log detailed information for debugging while showing user-friendly messages

### Requirement 10

**User Story:** As a user, I want responsive performance during screenshot operations, so that the interface remains usable while captures are running.

#### Acceptance Criteria

1. WHEN screenshot capture is running THEN the system SHALL show progress indicators and remain responsive
2. WHEN multiple targets are being processed THEN the system SHALL handle them efficiently without blocking the UI
3. WHEN large screenshots are being captured THEN the system SHALL manage memory usage appropriately
4. WHEN browser instances are created THEN the system SHALL reuse them efficiently and clean up properly
5. IF operations take longer than expected THEN the system SHALL provide status updates and allow cancellation where possible
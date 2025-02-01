# Project Overview
- **Name**: Merrouch Gaming
- **Description**: A web application for Merrouch Gaming Center, providing users with real-time information about their available time, points, and computer availability.
- **Purpose**: To enhance the gaming experience by offering transparency and convenience for users to track their usage and find available resources.

# Technology Stack
- **Frontend**: React, Next.js, CSS
- **Backend**: Node.js, Supabase
- **Database**: PostgreSQL , Supabase
- **APIs**: gizmo external API , supabase

# Architecture
- **Structure**: Client-server architecture with a RESTful API.
- **Components**: 
  - Authentication: Handles user login and registration.
  - Dashboard: Displays user progress and statistics.
  - Upload: Allows users to upload videos and generate thumbnails.
  - Video: Displays the uploaded video and its thumbnail.


# User Flow
- **User Roles**: Admin, Regular User
- **User Journey**: 
  1. User logs in.
  2. User is redirected to the dashboard.
  3. User can upload a video and generate a thumbnail.
  4. User can view the uploaded video and its thumbnail.
  5. User can view the available time, points, and computer availability.
# Features
- **Core Features**: 
  - User authentication
  - Progress tracking
  - Messaging system
- **Future Features**: 
  - Integration with wearable devices
  - Social sharing options

# Challenges
- **Current Challenges**: 
  - Performance issues with data fetching.
- **Technical Debt**: 
  - Need to refactor the authentication module.

# Documentation
- **Supabase Documentation**: [Supabase JavaScript Reference](https://supabase.com/docs/reference/javascript/start)
- **Code Comments**: Code is commented for clarity.

# Installation
- **Prerequisites**: Node.js, npm, PostgreSQL
- **Steps**: 
  1. Clone the repository.
  2. Run `npm install`.
  3. Run `npm start`.

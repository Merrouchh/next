# Clip Processing Status Management

This document describes the centralized clip processing status management system implemented to prevent status cycling and ensure consistent progression through the video processing pipeline.

## Overview

The system uses a centralized status management approach to handle the progression of video clips through various processing stages, from initial upload to final completion. By centralizing status management, we prevent status cycling issues where statuses might move backward or oscillate between states.

### Architecture Components

1. **lib/statusUtils.js**: The shared utilities module that contains common status-related functions and constants
2. **CloudFlareStreamProgressDataUpdate/src/index.js**: The central monitoring service that handles status progression
3. **pages/api/cloudflare/enable-mp4.js**: API endpoint for MP4 generation that signals status changes
4. **pages/api/cloudflare/upload-to-r2.js**: API endpoint for R2 storage upload that signals status changes

## Status Progression Order

Statuses are defined with an explicit order to prevent backward movement:

| Status            | Order | Description                                 |
|-------------------|-------|---------------------------------------------|
| uploading         | 1     | Initial upload to Cloudflare                |
| queued            | 2     | Queued for processing in Cloudflare         |
| processing        | 3     | Processing by Cloudflare                    |
| stream_ready      | 4     | Ready for streaming but no MP4 yet          |
| waitformp4        | 5     | Waiting for MP4 to be generated             |
| mp4_processing    | 6     | MP4 is being processed                      |
| mp4downloading    | 7     | MP4 is being downloaded                     |
| r2_uploading      | 8     | Uploading to R2 storage                     |
| complete          | 9     | Processing complete                         |
| error             | 10    | Error state (can happen at any point)       |

## Status Signaling Mechanism

Instead of API endpoints directly changing statuses, they "signal" requested status changes via the `processing_details` JSON field:

1. API endpoints update the `processing_details` field with a `requested_status` property
2. The main monitoring service checks for videos with `requested_status` set and applies the changes

This approach prevents race conditions and ensures proper status validation.

## Key Functions

- **updateProcessingDetails(videoUid, details, logPrefix)**: Updates only the processing_details field without changing status
- **signalStatusUpdate(videoUid, nextStatus, details, logPrefix)**: Signals for a status change request
- **isValidStatusTransition(currentStatus, newStatus)**: Validates if a status transition is allowed
- **getStatusMessage(status)**: Gets a human-readable message for a status
- **getMinProgressForStatus(status)**: Gets the minimum progress percentage for a status

## Special Cases

- **Error status**: Can be set from any state
- **MP4 Processing**: Special handling is provided for transitions between `waitformp4` and `mp4_processing` states

## Integration with Database

The status system integrates with the `clips` table, which has:

- `status`: A text field storing the current processing status
- `processing_details`: A JSONB field storing detailed information about processing

## Benefits of the Approach

1. **Single Source of Truth**: All status changes flow through one path
2. **Validation**: Status transitions are validated against rules
3. **Detailed History**: Complete processing details are preserved
4. **Separation of Concerns**: Each component has clear responsibilities
5. **Resilience**: System handles errors gracefully

## Sample Flow

1. User uploads a video -> status: `uploading`
2. Cloudflare queues the video -> status: `queued`
3. Cloudflare processes the video -> status: `processing`
4. Video is ready for streaming -> status: `stream_ready`
5. MP4 creation starts -> status: `waitformp4`
6. MP4 is ready -> status: `mp4downloading`
7. MP4 upload to R2 starts -> status: `r2_uploading`
8. Processing is complete -> status: `complete`

## Implementation Notes

- API endpoints were updated to use the shared utility module
- Double statuses were prevented by careful coordination between components
- Progress never moves backward due to minimum values per status
- Status messages are consistently applied across the application 
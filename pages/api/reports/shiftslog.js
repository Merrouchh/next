export default async function handler(req, res) {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get date parameters
    const { dateFrom, dateTo, reportType = 2 } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'Missing required parameters: dateFrom and dateTo are required' 
      });
    }

    // Get the Gizmo API URL and authorization from environment variables
    const gizmoApiUrl = process.env.API_BASE_URL;
    const gizmoApiAuth = `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`;
    
    // Construct the URL for the Gizmo API
    const registerId = process.env.GIZMO_REGISTER_ID || 8;
    const baseUrl = gizmoApiUrl ? gizmoApiUrl.replace(/\/+$/, '') : '';
    
    // Use the reportType parameter to get either simple or detailed shift reports
    // reportType=1: Simple shift reports (default in previous implementation)
    // reportType=2: Detailed shift reports with payment method breakdowns
    const shiftsLogReportType = reportType || 2;
    
    const url = `${baseUrl}/reports/shiftslog/register/${registerId}?ShiftsLogReportType=${shiftsLogReportType}&DateFrom=${dateFrom}&DateTo=${dateTo}`;

    // Make the request to the Gizmo API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': gizmoApiAuth,
        'Content-Type': 'application/json'
      }
    });

    // Handle error responses from the Gizmo API
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gizmo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return res.status(response.status).json({ 
        error: `Gizmo API error: ${response.statusText}`,
        details: errorData
      });
    }

    // Parse and return the response data
    const data = await response.json();
    
    // Process shifts to add calculated end time for active shifts
    if (data?.result?.shifts && Array.isArray(data.result.shifts)) {
      const now = new Date();
      
      data.result.shifts = data.result.shifts.map(shift => {
        // If shift is active and has no end time, calculate one
        if (shift.isActive && !shift.endTime) {
          // Create a duplicate shift with calculated end time
          const startTime = new Date(shift.startTime);
          
          // Calculate minutes between start time and now
          const diffMs = now - startTime;
          const diffMinutes = Math.floor(diffMs / 60000);
          
          // Update shift with calculated duration and end time
          return {
            ...shift,
            calculatedEndTime: now.toISOString(),
            durationMinutes: diffMinutes,
            duration: formatDuration(diffMinutes)
          };
        }
        return shift;
      });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in shift reports API handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Helper function to format duration in hours and minutes
function formatDuration(minutes) {
  if (!minutes || isNaN(minutes)) return '';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
} 
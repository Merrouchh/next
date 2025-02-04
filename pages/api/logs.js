import createServerSupabaseClient from '../../utils/supabase/api';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Verify admin access
        const supabase = createServerSupabaseClient(req, res);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if user is admin
        const { data: userData } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!userData?.is_admin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get recent logs from your server
        const logs = {
            uploadLogs: global.uploadLogs || [],
            systemInfo: {
                platform: process.platform,
                nodeVersion: process.version,
                memory: process.memoryUsage(),
                cwd: process.cwd(),
                uptime: process.uptime()
            },
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        };

        return res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        return res.status(500).json({ error: 'Failed to fetch logs' });
    }
} 
const sql = require('mssql');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

module.exports = async function (context, req) {
    // Set headers for CORS and explicit JSON response
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 204,
            headers: headers
        };
        return;
    }

    try {
        const query = req.query || {};
        const body = req.body || {};

        const carerName = query.carerName || body.carerName;
        const clientName = query.clientName || body.clientName;
        const location = query.location || body.location || 'Check-In';

        if (!carerName || !clientName) {
            context.res = {
                status: 400,
                headers: headers,
                body: JSON.stringify({ success: false, message: 'Missing carer or client name.' })
            };
            return;
        }

        // Connect and save to SQL Database
        const pool = await sql.connect(sqlConfig);
        await pool.request()
            .input('CarerName', sql.NVarChar, carerName)
            .input('ClientName', sql.NVarChar, clientName)
            .input('ActionType', sql.NVarChar, location)
            .input('IsVerified', sql.Bit, 1)
            .input('Distance', sql.Float, 0)
            .query(`
                INSERT INTO dbo.VisitLogs (CarerName, ClientName, ActionType, LogTime, IsVerified, DistanceFromClientMeters)
                VALUES (@CarerName, @ClientName, @ActionType, GETUTCDATE(), @IsVerified, @Distance)
            `);

        context.res = {
            status: 200,
            headers: headers,
            body: JSON.stringify({ success: true, message: 'Visit logged successfully!' })
        };

    } catch (err) {
        context.log.error('Error logging visit:', err);
        context.res = {
            status: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Database/Server error: ' + err.message })
        };
    }
};

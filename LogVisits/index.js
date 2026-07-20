const sql = require('mssql');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

module.exports = async function (context, req) {
    // Enable CORS headers for all responses
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    // Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 204;
        return;
    }

    try {
        // Extract parameters from either GET query or POST body
        const carerName = (req.query && req.query.carerName) || (req.body && req.body.carerName);
        const clientName = (req.query && req.query.clientName) || (req.body && req.body.clientName);
        const location = (req.query && req.query.location) || (req.body && req.body.location) || 'Check-In';

        if (!carerName || !clientName) {
            context.res.status = 400;
            context.res.body = { success: false, message: 'Missing carer or client name.' };
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

        context.res.status = 200;
        context.res.body = { success: true, message: 'Visit logged successfully!' };

    } catch (err) {
        context.log('Error logging visit:', err);
        context.res.status = 500;
        context.res.body = { success: false, message: 'Database/Server error: ' + err.message };
    }
};
};

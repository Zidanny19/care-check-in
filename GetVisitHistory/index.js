const sql = require('mssql');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true
    }
};

module.exports = async function (context, req) {
    context.log('Processing GetVisitHistory request...');

    const clientName = req.query.clientName;
    const carerName = req.query.carerName;

    try {
        // Connect to SQL and assign the connection pool
        const pool = await sql.connect(sqlConfig);

        let query = `SELECT TOP 50 LogID, CarerName, ClientName, ActionType, LogTime, IsVerified, DistanceFromClientMeters 
                     FROM dbo.VisitLogs WHERE 1=1`;

        // Pass the connection pool directly to sql.Request
        const request = new sql.Request(pool);

        if (clientName) {
            query += ` AND ClientName = @clientName`;
            request.input('clientName', sql.VarChar, clientName);
        }

        if (carerName) {
            query += ` AND CarerName = @carerName`;
            request.input('carerName', sql.VarChar, carerName);
        }

        query += ` ORDER BY LogTime DESC`;

        const result = await request.query(query);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: true,
                count: result.recordset.length,
                logs: result.recordset
            }
        };

    } catch (err) {
        context.log.error('Database error:', err.message);
        context.res = {
            status: 500,
            body: { error: `Database error: ${err.message}` }
        };
    }
};

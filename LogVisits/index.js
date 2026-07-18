const sql = require('mssql');
const geolib = require('geolib');

// Your Azure SQL connection configuration
// We will load these securely from Azure Environment Variables next!
const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Use encryption for Azure SQL
        trustServerCertificate: false
    }
};

module.exports = async function (context, req) {
    context.log('Processing a care visit log request...');

    // 1. Validate the incoming request body
    const { carerName, clientName, actionType, latitude, longitude } = (req && req.body) || {};

    if (!carerName || !clientName || !actionType || !latitude || !longitude) {
        context.res = {
            status: 400,
            body: "Missing required fields: carerName, clientName, actionType, latitude, longitude."
        };
        return;
    }

    let pool;
    try {
        // 2. Connect to the Azure SQL Database
        pool = await sql.connect(sqlConfig);

        // 3. Look up the client's registered coordinates from the database
        const clientResult = await pool.request()
            .input('clientName', sql.NVarChar, clientName)
            .query('SELECT Latitude, Longitude FROM Clients WHERE Name = @clientName');

        if (clientResult.recordset.length === 0) {
            context.res = {
                status: 404,
                body: `Client '${clientName}' not found in the database.`
            };
            return;
        }

        const clientLat = clientResult.recordset[0].Latitude;
        const clientLon = clientResult.recordset[0].Longitude;

        // 4. Calculate the distance between the carer and the client's home (in meters)
        const distanceInMeters = geolib.getDistance(
            { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            { latitude: parseFloat(clientLat), longitude: parseFloat(clientLon) }
        );

        // Define a reasonable radius (e.g., 150 meters) to confirm if they are on-site
        const maxRadiusMeters = 150; 
        const isVerified = distanceInMeters <= maxRadiusMeters;

        // 5. Insert the log entry into the VisitLogs table
        await pool.request()
            .input('carerName', sql.NVarChar, carerName)
            .input('clientName', sql.NVarChar, clientName)
            .input('actionType', sql.VarChar, actionType)
            .input('latitude', sql.Decimal(9, 6), parseFloat(latitude))
            .input('longitude', sql.Decimal(9, 6), parseFloat(longitude))
            .input('distance', sql.Int, distanceInMeters)
            .input('isVerified', sql.Bit, isVerified ? 1 : 0)
            .query(`
                INSERT INTO VisitLogs (CarerName, ClientName, ActionType, Latitude, Longitude, DistanceFromClientMeters, IsVerified, LogTime)
                VALUES (@carerName, @clientName, @actionType, @latitude, @longitude, @distance, @isVerified, GETDATE())
            `);

        // 6. Return success response to the carer's mobile screen
        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: {
                message: `Successfully logged ${actionType}!`,
                distanceMeters: distanceInMeters,
                verified: isVerified
            }
        };

    } catch (err) {
        context.log.error('Database or system error:', err.message);
        context.res = {
            status: 500,
            body: `Internal Server Error: ${err.message}`
        };
    } finally {
        if (pool) {
            await pool.close();
        }
    }
};
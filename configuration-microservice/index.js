const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
const a = 'R'; 

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, 'env/development.env') });

(async () => {
  try {
    // Load the Excel workbook
    const workbook = XLSX.readFile('Admin_Panel_Features.xlsx');

    // Establish a connection to the MySQL database
    const db = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASS,
      database: process.env.MYSQL_DB,
    });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      // Proceed only if data exists and contains the 'platform' field
      if (rows.length > 0 && rows[0].platform !== undefined) {
        for (const row of rows) {
          const name = row.name;
          const platform = row.platform;

          if (name && platform) {
            try {
              // Check if platform is already set
              const [existingRows] = await db.execute(
                `SELECT platform FROM \`${sheetName}\` WHERE name = ?`,
                [name]
              );
              
              if (existingRows.length > 0 && existingRows[0].platform) {
                // console.log(`Skipped update for '${sheetName}' table, name='${name}' - platform already set.`);
                continue; // Skip update if platform already has a value
              }

              // Perform the update
              await db.execute(
                `UPDATE \`${sheetName}\` SET platform = ? WHERE name = ?`,
                [platform, name]
              );
              console.log(`Updated '${sheetName}' table for name='${name}'`);
            } catch (err) {
              console.error(`Error updating '${sheetName}' for name='${name}': ${err.message}`);
            }
          } else {
            console.warn(`Skipping row in '${sheetName}' due to missing 'name' or 'platform':`, row);
          }
        }
      } else {
        console.warn(`Skipping sheet '${sheetName}' due to missing or invalid data.`);
      }
    }

    // Close the database connection
    await db.end();
    console.log('Database update completed successfully.');

  } catch (err) {
    console.error('An error occurred during processing:', err.message);
    process.exit(1);
  }
})();

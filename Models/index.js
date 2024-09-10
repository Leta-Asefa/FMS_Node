const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

async function initializeDatabase() {
    try {
        // Connect to MySQL server
        const connection = await mysql.createConnection({
            host: process.env.HOST,
            user: process.env.MYSQL_DB_USERNAME,
            password: process.env.MYSQL_DB_PASSWORD
        });
        // console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DB_NAME}`);
        // console.log('Database created or already exists');

        // Close the connection
        await connection.end();
        // console.log('MySQL connection closed');

        // Initialize Sequelize with the created database
        const sequelize = new Sequelize(process.env.MYSQL_DB_NAME, process.env.MYSQL_DB_USERNAME, process.env.MYSQL_DB_PASSWORD, {
            host: process.env.HOST,
            dialect: 'mysql'
        });
        // console.log('Sequelize initialized');

        // Define your models and other logic here
        const db = {};

        // Import models
        db.User = require('./User')(sequelize, Sequelize.DataTypes);
        db.Folder = require('./Folder')(sequelize, Sequelize.DataTypes);
        db.File = require('./File')(sequelize, Sequelize.DataTypes);
       
        db.Folder.hasMany(db.File, { foreignKey: 'folderId', as: 'childfiles' });
          
        db.Folder.hasMany(db.Folder, { as: 'childfolders', foreignKey: 'ParentFolderId' });
        

        // Sync models with database
        await sequelize.sync();

        db.sequelize = sequelize;
        db.Sequelize = Sequelize;
        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

module.exports = initializeDatabase;

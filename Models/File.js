const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: uuidv4, // Generate a UUID by default
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      hashedName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      size: {
        type: DataTypes.INTEGER,
      },
      type: {
        type: DataTypes.STRING,
      },
      owner: {
        type: DataTypes.STRING,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    } , {
    tableName: 'files',
    timestamps: true
  });

  return File;
};




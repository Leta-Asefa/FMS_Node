const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
      
    owner: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false // Disable updatedAt column
  });

  return Notification;
};
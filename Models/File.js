module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File',
    {
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




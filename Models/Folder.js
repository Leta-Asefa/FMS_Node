module.exports = (sequelize, DataTypes) => {
    const Folder = sequelize.define('Folder', {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: "Folder name is required" }
        }
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: "Path is required" }
        }
      },
      files: {
        type: DataTypes.JSON,
        allowNull: true
      },
      subfolders: {
        type: DataTypes.JSON,
        allowNull: true
      },
      owner: {
        type: DataTypes.STRING,
        allowNull: true
      },
      read: {
        type: DataTypes.JSON,
        allowNull: true
      },
      write: {
        type: DataTypes.JSON,
        allowNull: true
      },
      readWrite: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: 'folders',
      timestamps: true
    });

 
  
    return Folder;
  };
  
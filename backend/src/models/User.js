const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    online: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastSeen: { type: DataTypes.DATE }
  },
  {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    }
  }
);

User.prototype.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

User.prototype.toSafe = function () {
  const safe = this.toJSON();
  delete safe.passwordHash;
  return safe;
};

module.exports = User;
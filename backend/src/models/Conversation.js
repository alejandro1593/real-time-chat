const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define(
  'Conversation',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.ENUM('direct', 'group'), allowNull: false, defaultValue: 'direct' },
    name: { type: DataTypes.STRING(80) },
    ownerId: { type: DataTypes.UUID }
  },
  { tableName: 'conversations' }
);

module.exports = Conversation;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define(
  'Message',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    conversationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    image: { type: DataTypes.TEXT },
    file: { type: DataTypes.JSONB },
    replyTo: { type: DataTypes.JSONB },
    reactions: { type: DataTypes.JSONB, defaultValue: {} },
    edited: { type: DataTypes.BOOLEAN, defaultValue: false },
    deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    deletedAt: { type: DataTypes.DATE },
    readBy: { type: DataTypes.JSONB, defaultValue: [] }
  },
  { tableName: 'messages', updatedAt: true }
);

module.exports = Message;
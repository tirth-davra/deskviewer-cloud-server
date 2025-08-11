const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./User");

const Recent_sessions = sequelize.define(
  "Recent_sessions",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    session_id: {
      type: DataTypes.BIGINT, // Use BIGINT to handle 10-digit numbers
      allowNull: false,
      validate: {
        len: [10, 10], // 10-digit session codes
        isNumeric: true,
      },
    },
  },
  {
    tableName: "recent_sessions",
    timestamps: true, // Enable timestamps since we now have created_at/updated_at columns
    indexes: [
      {
        unique: true,
        fields: ["user_id", "session_id"], // Prevent duplicate entries for same user-session combination
      },
      {
        fields: ["user_id"], // For faster queries by user
      },
    ],
  }
);

// Define association with User model
Recent_sessions.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasMany(Recent_sessions, {
  foreignKey: "user_id",
  as: "recentSessions",
});

module.exports = Recent_sessions;

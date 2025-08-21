const { DataTypes } = require("sequelize");
const crypto = require("crypto");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    email: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
      },
    },
    first_name: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    session_id: {
      type: DataTypes.BIGINT,
      unique: true,
      allowNull: true,
      validate: {
        len: [10, 10], // 10-digit session codes
        isNumeric: true,
      },
    },
  },
  {
    tableName: "users",
    hooks: {
      // Hash password with MD5 before saving
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = crypto
            .createHash("md5")
            .update(user.password)
            .digest("hex");
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = crypto
            .createHash("md5")
            .update(user.password)
            .digest("hex");
        }
      },
    },
    timestamps: false,
  }
);

// Instance method to compare password using MD5
User.prototype.comparePassword = async function (candidatePassword) {
  const hashedPassword = crypto
    .createHash("md5")
    .update(candidatePassword)
    .digest("hex");
  return hashedPassword === this.password;
};

// Instance method to get public profile (without password)
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

module.exports = User;

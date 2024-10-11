import { Sequelize, DataTypes, Model } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
});

export class NewTokens extends Model {
  public id!: number;
  public tokenAddress!: string;
  public deployerAddress!: string;
  public pairAddress!: string;
  public tradingEnabled!: boolean;
  public tokenName!: string;
}

NewTokens.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    tokenAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    tokenName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deployerAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pairAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tradingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "new_tokens",
  }
);

export class SniperBots extends Model {
  public id!: number;
  public address!: string;
  public name!: string;
}

SniperBots.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: "sniper_bots",
  }
);

export class SniperApprovalActivities extends Model {
  public id!: number;
  public sniperId!: number;
  public newTokenId!: number;
  public txHash!: string;
}

SniperApprovalActivities.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sniperId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SniperBots,
        key: "id",
      },
    },
    newTokenId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: NewTokens,
        key: "id",
      },
    },
    timestamp: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    txHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: "sniper_approval_activities",
  }
);

export class ScopeOptionUser extends Model {
  public userId!: string;
  public optionType!: number;
  public status!: boolean;
  public startTime!: number;
  public expireTime!: number;
  public tokenAddress!: string;
}

ScopeOptionUser.init(
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    optionType: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    expireTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tokenAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "scope_option_user",
  }
);

NewTokens.hasMany(SniperApprovalActivities, {
  foreignKey: "newTokenId",
  sourceKey: "id",
  as: "approvalActivities",
});

SniperBots.hasMany(SniperApprovalActivities, {
  foreignKey: "sniperId",
  sourceKey: "id",
  as: "approvalActivities",
});

SniperApprovalActivities.belongsTo(NewTokens, {
  foreignKey: "newTokenId",
  targetKey: "id",
  as: "newToken",
});

SniperApprovalActivities.belongsTo(SniperBots, {
  foreignKey: "sniperId",
  targetKey: "id",
  as: "sniperBot",
});

sequelize.sync();

export default sequelize;

import { Sequelize, DataTypes, Model } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
});

export class Keyword extends Model {
  public keyword!: string;
}

Keyword.init(
  {
    keyword: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: "keywords",
  }
);

export class ScrapeGroups extends Model {
  public groupId!: string;
  public groupName!: string;
  public groupTitle!: string;
}

ScrapeGroups.init(
  {
    groupId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    groupName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    groupTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "scrape_groups",
  }
);

sequelize.sync();

export default sequelize;

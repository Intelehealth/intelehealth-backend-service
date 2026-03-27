import { DataTypes, Optional } from "sequelize";
import {
  Table,
  Model,
  Column,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";

export interface UserAIStatusAttributes {
  id: number;
  user_uuid: string;
  name: string;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserAIStatusCreationAttributes extends Optional<UserAIStatusAttributes, "id"> {}

@Table({
  timestamps: true,
  tableName: "mst_user_ai_status",
})
export class UserAIStatus extends Model<
  UserAIStatusAttributes,
  UserAIStatusCreationAttributes
> {
  @Column({
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  })
  user_uuid!: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  })
  is_enabled!: boolean;

  @CreatedAt
  @Column
  createdAt!: Date;

  @UpdatedAt
  @Column
  updatedAt!: Date;
}

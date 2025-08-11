import { DataTypes, Optional } from "sequelize";
import {
  Table,
  Model,
  Column,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from "sequelize-typescript";

export interface AILLMRecordingAttributes {
  id: number;
  name: string;
  key: string;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface AILLMRecordingCreationAttributes extends Optional<AILLMRecordingAttributes, "id"> {}

@Table({
  timestamps: true,
  paranoid: true,
  tableName: "mst_ai_llm_recording",
})
export class AILLMRecording extends Model<
  AILLMRecordingAttributes,
  AILLMRecordingCreationAttributes
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
  key!: string;

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

  @DeletedAt
  @Column
  deletedAt!: Date;
}

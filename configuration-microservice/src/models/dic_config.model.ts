import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface ConfigAttributes {
  id: number;
  key: string;
  value: string;
  type: string;
  default_value: string;
  published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface ConfigCreationAttributes extends Optional<ConfigAttributes, 'id'> {}

@Table({
    timestamps: true,
    paranoid: true,
    tableName: "dic_config"
})
export class Config extends Model<ConfigAttributes, ConfigCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    key!: string;

    @Column({
        type: DataTypes.TEXT,
        defaultValue: null
    })
    value!: string;

    @Column({
        type: DataTypes.STRING,
        allowNull: false
    })
    type!: string;

    @Column({
        type: DataTypes.TEXT,
        defaultValue: null
    })
    default_value!: string;

    @Column({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    published!: boolean;

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
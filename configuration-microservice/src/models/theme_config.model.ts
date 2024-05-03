import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface ThemeConfigAttributes {
  id: number;
  key: string;
  value: string|null;
  default_value: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ThemeConfigCreationAttributes extends Optional<ThemeConfigAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "theme_config"
})
export class ThemeConfig extends Model<ThemeConfigAttributes, ThemeConfigCreationAttributes> {
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
        defaultValue: null,
        allowNull: true,
    })
    value!: string|null;

    @Column({
        type: DataTypes.TEXT,
        allowNull: false,
    })
    default_value!: string;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}
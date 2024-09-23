import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export interface SidebarMenuAttributes {
  id: number;
  name: string;
  key: string;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SidebarMenuCreationAttributes extends Optional<SidebarMenuAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "mst_sidebar_menus"
})
export class SidebarMenu extends Model<SidebarMenuCreationAttributes, SidebarMenuCreationAttributes> {
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
    name!: string;

    @Column({
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    })
    key!: string;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_enabled!: boolean;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}
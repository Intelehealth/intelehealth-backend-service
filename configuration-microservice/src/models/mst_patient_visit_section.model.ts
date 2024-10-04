import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export interface SidebarMenuAttributes {
  id: number;
  name: string;
  key: string;
  is_enabled: boolean;
  is_locked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SidebarMenuCreationAttributes extends Optional<SidebarMenuAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "mst_patient_visit_sections"
})
export class PatientVisitSection extends Model<SidebarMenuCreationAttributes, SidebarMenuCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
        type: DataTypes.JSON,
        allowNull: true
    })
    name!: string;

    @Column({
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    })
    key!: string;

    @Column({
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    })
    order!: number;

    @Column({
      type: DataTypes.BOOLEAN,
      defaultValue: false
    })
    is_editable!: boolean;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_enabled!: boolean;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_locked!: boolean;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}
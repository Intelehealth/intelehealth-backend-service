import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface SpecializationAttributes {
  id: number;
  name: string;
  key: string;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SpecializationCreationAttributes extends Optional<SpecializationAttributes, 'id'> {}

@Table({
    timestamps: true,
    paranoid: true,
    tableName: "mst_specialization"
})
export class Specialization extends Model<SpecializationAttributes, SpecializationCreationAttributes> {
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

    @DeletedAt
    @Column
    deletedAt!: Date;
}
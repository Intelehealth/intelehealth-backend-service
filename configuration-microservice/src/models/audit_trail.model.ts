import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface AuditTrailAttributes {
  id: number;
  user_id: number;
  activity_type: string;
  description?: string;
  default_value: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditTrailCreationAttributes extends Optional<AuditTrailAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "audit_trail"
})
export class AuditTrail extends Model<AuditTrailAttributes, AuditTrailCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
        type: DataTypes.INTEGER,
        allowNull: false
    })
    user_id!: number;

    @Column({
        type: DataTypes.STRING,
        allowNull: false
    })
    activity_type!: string;

    @Column({
        type: DataTypes.TEXT,
        defaultValue: null
    })
    description!: string;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}
import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface PatientVisitSummaryAttributes {
  id: number;
  name: string;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PatientVisitSummaryCreationAttributes extends Optional<PatientVisitSummaryAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "mst_patient_visit_summary"
})
export class PatientVisitSummary extends Model<PatientVisitSummaryAttributes, PatientVisitSummaryCreationAttributes> {
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
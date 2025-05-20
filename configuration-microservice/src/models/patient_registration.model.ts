import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface PatientRegistrationAttributes {
  id: number;
  name: string;
  key: string;
  section: string;
  is_mandatory: boolean;
  is_editable: boolean;
  is_enabled: boolean;
  is_locked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  validations?: object;
}

export interface PatientRegistrationCreationAttributes extends Optional<PatientRegistrationAttributes, 'id'> {}

@Table({
    timestamps: true,
    paranoid: true,
    tableName: "mst_patient_registration"
})
export class PatientRegistration extends Model<PatientRegistrationAttributes, PatientRegistrationCreationAttributes> {
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
        type: DataTypes.ENUM,
        values: ['Personal','Address','Other'],
        allowNull: false
    })
    section!: string;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_mandatory!: boolean;

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

    @Column({
        type: DataTypes.JSON,
        allowNull: true
    })
    validations!: object;

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
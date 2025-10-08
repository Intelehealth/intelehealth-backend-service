import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface AuditTrailAttributes {
  id: number;
  user_id: string;
  user_name: string;
  activity_type: string;
  description?: string;
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
        type: DataTypes.STRING,
        allowNull: false
    })
    user_id!: string;

    @Column({
        type: DataTypes.STRING
    })
    user_name!: string;

    @Column({
        type: DataTypes.ENUM,
        values: [
            'CONFIG PUBLISHED',
            'SPECIALIZATION STATUS UPDATED',
            'LANGUAGE STATUS UPDATED',
            'LANGUAGE SET AS DEFAULT',
            'PATIENT REGISTRATION FIELD STATUS UPDATED',
            'PATIENT REGISTRATION FIELD MANDATORY STATUS UPDATED',
            'PATIENT REGISTRATION FIELD EDITABLE STATUS UPDATED',
            'THEME CONFIG UPDATED',
            'VITAL ENABLED STATUS UPDATED',
            'VITAL MANDATORY STATUS UPDATED',
            'WEBRTC CONFIG UPDATED',
            'FEATURE CONFIG UPDATED',
            'PATIENT VISIT SUMMARY SECTION STATUS UPDATED',
            'DIAGNOSTIC ENABLED STATUS UPDATED',
            'DIAGNOSTIC MANDATORY STATUS UPDATED',
            'SIDEBAR MENU STATUS UPDATED',
            'PATIENT VISIT SECTION ENABLED STATUS UPDATED',
            'PATIENT VISIT SECTION NAME UPDATED',
            'PATIENT VISIT SECTION ORDER UPDATED',
            'VITAL NAME UPDATED',
            'ROSTER QUESTIONNAIRE CONFIG UPDATED',
            'PATIENT REGISTRATION FIELD VALIDATION UPDATED',
            'DROPDOWN CONFIG UPDATED',
            'HOME SCREEN SECTION NAME UPDATED',
            'HOME SCREEN SECTION ENABLED STATUS UPDATED',
            'AI LLM CONFIG UPDATED',
            'AI LLM RECORDING CONFIG UPDATED',
            'PLATFORM UPDATED',
            'LANGUAGE PLATFORM UPDATED',
            'LANGUAGE STATUS UPDATED'
        ],
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

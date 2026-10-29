import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export interface PrescriptionNotesAttributes {
  id: number;
  specialty: string;
  notes: string[];
  is_enabled: boolean;
  platform?: 'Mobile' | 'Webapp' | 'Both' | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PrescriptionNotesCreationAttributes
  extends Optional<PrescriptionNotesAttributes, 'id'> {}

@Table({
  timestamps: true,
  tableName: 'mst_prescription_notes',
})
export class PrescriptionNotes extends Model<
  PrescriptionNotesAttributes,
  PrescriptionNotesCreationAttributes
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
  specialty!: string;

  @Column({
    type: DataTypes.JSON,
    allowNull: false,
  })
  notes!: string[];

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  })
  is_enabled!: boolean;

  @Column({
    type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
    allowNull: true,
  })
  platform!: 'Mobile' | 'Webapp' | 'Both' | null;

  @CreatedAt
  @Column
  createdAt!: Date;

  @UpdatedAt
  @Column
  updatedAt!: Date;
}

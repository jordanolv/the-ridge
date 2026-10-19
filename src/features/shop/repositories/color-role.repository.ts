import ColorRoleModel from '../models/color-role.model';

export class ColorRoleRepository {
  static async findRoleId(userId: string): Promise<string | undefined> {
    const doc = await ColorRoleModel.findOne({ userId }, { roleId: 1 });
    return doc?.roleId;
  }

  static async save(userId: string, roleId: string): Promise<void> {
    await ColorRoleModel.updateOne({ userId }, { $set: { roleId } }, { upsert: true });
  }

  static async remove(userId: string): Promise<void> {
    await ColorRoleModel.deleteOne({ userId });
  }
}

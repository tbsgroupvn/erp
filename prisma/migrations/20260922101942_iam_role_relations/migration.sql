-- AddForeignKey
ALTER TABLE "tbl_role_perm" ADD CONSTRAINT "tbl_role_perm_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tbl_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_user_role" ADD CONSTRAINT "tbl_user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tbl_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

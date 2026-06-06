import React from 'react';
import AdminCsvImportModal from '../AdminCsvImportModal/AdminCsvImportModal';
import { CSV_IMPORT_CONFIGS } from '../../../utils/csvImportConfigs';

const AdminUsersImportModal = ({ isOpen, onClose, onImported }) => {
  return (
    <AdminCsvImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={CSV_IMPORT_CONFIGS.users}
      onImported={onImported}
    />
  );
};

export default AdminUsersImportModal;
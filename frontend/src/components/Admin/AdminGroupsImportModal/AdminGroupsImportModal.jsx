import React from 'react';
import AdminCsvImportModal from '../AdminCsvImportModal/AdminCsvImportModal';
import { CSV_IMPORT_CONFIGS } from '../../../utils/csvImportConfigs';

const AdminGroupsImportModal = ({ isOpen, onClose, onImported }) => (
  <AdminCsvImportModal
    isOpen={isOpen}
    onClose={onClose}
    config={CSV_IMPORT_CONFIGS.groups}
    onImported={onImported}
  />
);

export default AdminGroupsImportModal;

import React from 'react';
import AdminCsvImportModal from '../AdminCsvImportModal/AdminCsvImportModal';
import { CSV_IMPORT_CONFIGS } from '../../../utils/csvImportConfigs';

const AdminSubjectsImportModal = ({ isOpen, onClose, onImported }) => (
  <AdminCsvImportModal
    isOpen={isOpen}
    onClose={onClose}
    config={CSV_IMPORT_CONFIGS.subjects}
    onImported={onImported}
  />
);

export default AdminSubjectsImportModal;

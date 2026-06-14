import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import { useNotification } from '../../../context/NotificationContext';
import './PublishFromBankModal.scss';

const normalizeGroupSelection = (value) => {
  const normalizeSingleGroup = (group) =>
    (group || '')
      .toString()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[—–−]/g, '-')
      .toUpperCase();

  if (Array.isArray(value)) {
    return value
      .map((group) => normalizeSingleGroup(group))
      .filter(Boolean)
      .filter((group, index, array) => array.indexOf(group) === index);
  }

  const singleGroup = normalizeSingleGroup(value);
  return singleGroup ? [singleGroup] : [];
};

const normalizeTeachingLoadPairs = (pairs = []) => {
  if (!Array.isArray(pairs)) {
    return [];
  }

  return pairs
    .map((pair) => {
      const subjectId = Number(pair?.subjectId ?? pair?.subject_id);
      const groupName = normalizeGroupSelection(pair?.groupName ?? pair?.group_name)[0] || '';

      if (!Number.isFinite(subjectId) || subjectId <= 0 || !groupName) {
        return null;
      }

      return { subjectId, groupName };
    })
    .filter(Boolean)
    .filter((pair, index, array) => array.findIndex((item) => item.subjectId === pair.subjectId && item.groupName === pair.groupName) === index);
};

const PublishFromBankModal = ({
  isOpen,
  template,
  availableGroups = [],
  teachingLoadPairs = [],
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const { showError } = useNotification();
  const [deadline, setDeadline] = useState('');
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [groupPickerDraft, setGroupPickerDraft] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const triggerRef = useRef(null);
  const menuPortalRef = useRef(null);
  const [groupMenuLayout, setGroupMenuLayout] = useState(null);

  const updateGroupMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const maxH = Math.min(420, Math.max(100, spaceBelow));
    setGroupMenuLayout({
      top: r.bottom + 6,
      left: r.left,
      width: r.width,
      maxHeight: maxH,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDeadline('');
      setStudentGroups([]);
      setIsGroupsOpen(false);
    }
  }, [isOpen, template?.id]);

  const templateSubjectId = Number(template?.subject_id ?? template?.subjectId ?? template?.subject?.id);
  const relationPairs = useMemo(() => normalizeTeachingLoadPairs(teachingLoadPairs), [teachingLoadPairs]);

  const groupOptions = useMemo(() => {
    const normalizedGroups = normalizeGroupSelection(availableGroups);
    const filteredGroups = relationPairs.length > 0 && Number.isFinite(templateSubjectId) && templateSubjectId > 0
      ? normalizedGroups.filter((groupName) => relationPairs.some((pair) => pair.subjectId === templateSubjectId && pair.groupName === groupName))
      : normalizedGroups;
    const set = new Set(filteredGroups.filter(Boolean));
    return Array.from(set);
  }, [availableGroups, relationPairs, templateSubjectId]);

  useEffect(() => {
    const allowedGroups = new Set(groupOptions);
    const currentGroups = normalizeGroupSelection(studentGroups);
    const nextGroups = currentGroups.filter((groupName) => allowedGroups.has(groupName));

    if (nextGroups.length !== currentGroups.length) {
      setStudentGroups(nextGroups);
    }
  }, [groupOptions, studentGroups]);

  const selectedGroups = normalizeGroupSelection(studentGroups);
  const draftSelectedGroups = normalizeGroupSelection(groupPickerDraft);
  const summary =
    selectedGroups.length === 0
      ? 'Выберите группы'
      : selectedGroups.length <= 2
        ? selectedGroups.join(', ')
        : `Выбрано групп: ${selectedGroups.length}`;

  const closeGroupsDropdown = useCallback(() => {
    setIsGroupsOpen(false);
  }, []);

  const openGroupsDropdown = useCallback(() => {
    setGroupPickerDraft(normalizeGroupSelection(studentGroups));
    setIsGroupsOpen(true);
  }, [studentGroups]);

  const toggleGroupsDropdown = useCallback(() => {
    if (isGroupsOpen) {
      closeGroupsDropdown();
      return;
    }
    openGroupsDropdown();
  }, [closeGroupsDropdown, isGroupsOpen, openGroupsDropdown]);

  const toggleGroup = (groupName) => {
    setGroupPickerDraft((prev) => {
      const current = normalizeGroupSelection(prev);
      return current.includes(groupName)
        ? current.filter((group) => group !== groupName)
        : [...current, groupName];
    });
  };

  const handleSelectAllGroups = () => {
    setGroupPickerDraft([...groupOptions]);
  };

  const handleClearGroups = () => {
    setGroupPickerDraft([]);
  };

  const handleConfirmGroupsSelection = () => {
    setStudentGroups(normalizeGroupSelection(groupPickerDraft));
    closeGroupsDropdown();
  };

  useLayoutEffect(() => {
    if (!isGroupsOpen) {
      setGroupMenuLayout(null);
      return undefined;
    }
    updateGroupMenuPosition();
    window.addEventListener('resize', updateGroupMenuPosition);
    window.addEventListener('scroll', updateGroupMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateGroupMenuPosition);
      window.removeEventListener('scroll', updateGroupMenuPosition, true);
    };
  }, [isGroupsOpen, updateGroupMenuPosition]);

  useEffect(() => {
    if (!isGroupsOpen) return undefined;
    const onDown = (e) => {
      const t = triggerRef.current;
      const m = menuPortalRef.current;
      if (t?.contains(e.target) || m?.contains(e.target)) {
        return;
      }
      closeGroupsDropdown();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [closeGroupsDropdown, isGroupsOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!template?.id || !onConfirm) return;
    const groups = normalizeGroupSelection(studentGroups);
    if (!deadline) {
      showError('Укажите срок сдачи');
      return;
    }
    if (groups.length === 0) {
      showError('Выберите хотя бы одну группу');
      return;
    }
    await onConfirm({
      templateId: template.id,
      deadline: `${deadline}T23:59:00`,
      studentGroups: groups,
    });
  };

  if (!isOpen || !template) return null;

  const subjectName = template.subject?.name || template.subject || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Выдать задание из банка"
      subtitle={`Содержимое берётся из заготовки «${template.title}». Уже выданные задания не меняются.`}
      size="medium"
      className="publish-bank-modal"
      contentClassName="publish-bank-modal__body"
      footer={(
        <div className="publish-bank-modal__actions">
          <Button type="submit" form="publish-bank-form" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Создание…' : 'Выдать задание'}
          </Button>
        </div>
      )}
    >
        <form id="publish-bank-form" onSubmit={handleSubmit}>
            <div className="publish-bank-meta">
              <span className="publish-bank-meta__subject">{subjectName || '—'}</span>
            </div>
            <div className="form-row publish-bank-form-row">
              <label className="publish-bank-label">
                Учебная группа
                <div className="group-dropdown">
                  <button
                    ref={triggerRef}
                    type="button"
                    className={`group-dropdown__trigger${isGroupsOpen ? ' is-open' : ''}`}
                    onClick={toggleGroupsDropdown}
                  >
                    <span>{summary}</span>
                    <span aria-hidden>▾</span>
                  </button>
                  {isGroupsOpen &&
                    groupMenuLayout &&
                    createPortal(
                      <div
                        ref={menuPortalRef}
                        className="publish-bank-modal publish-bank-modal__group-menu-layer"
                        style={{
                          position: 'fixed',
                          top: groupMenuLayout.top,
                          left: groupMenuLayout.left,
                          width: groupMenuLayout.width,
                          zIndex: 5200,
                          background: 'transparent',
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          className="group-dropdown__menu group-dropdown__menu--portal"
                          style={{
                            maxHeight: groupMenuLayout.maxHeight,
                            pointerEvents: 'auto',
                          }}
                        >
                          <div className="group-dropdown__actions">
                            <button type="button" onClick={handleSelectAllGroups}>
                              Выбрать все
                            </button>
                            <button type="button" onClick={handleClearGroups}>
                              Очистить
                            </button>
                          </div>
                          <div className="group-dropdown__list">
                            {groupOptions.map((group) => (
                              <label key={group} className="group-checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={draftSelectedGroups.includes(group)}
                                  onChange={() => toggleGroup(group)}
                                />
                                <span>{group}</span>
                              </label>
                            ))}
                          </div>
                          <div className="group-dropdown__confirm">
                            <Button
                              type="button"
                              variant="primary"
                              size="small"
                              fullWidth
                              onClick={handleConfirmGroupsSelection}
                            >
                              Подтвердить
                            </Button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                </div>
              </label>
              <label className="publish-bank-label">
                Срок сдачи
                <input
                  type="date"
                  value={deadline}
                  onChange={(ev) => setDeadline(ev.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="publish-bank-date"
                />
              </label>
            </div>
        </form>
    </Modal>
  );
};

export default PublishFromBankModal;

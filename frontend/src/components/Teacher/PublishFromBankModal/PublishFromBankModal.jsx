import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../UI/Button/Button';
import { useNotification } from '../../../context/NotificationContext';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
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

const PublishFromBankModal = ({
  isOpen,
  template,
  availableGroups = [],
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const { showError } = useNotification();
  const [deadline, setDeadline] = useState('');
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
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

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setDeadline('');
      setStudentGroups([]);
      setIsGroupsOpen(false);
    }
  }, [isOpen, template?.id]);

  const groupOptions = useMemo(() => {
    const set = new Set(availableGroups.filter(Boolean));
    normalizeGroupSelection(studentGroups).forEach((g) => set.add(g));
    return Array.from(set);
  }, [availableGroups, studentGroups]);

  const selectedGroups = normalizeGroupSelection(studentGroups);
  const summary =
    selectedGroups.length === 0
      ? 'Выберите группы'
      : selectedGroups.length <= 2
        ? selectedGroups.join(', ')
        : `Выбрано групп: ${selectedGroups.length}`;

  const toggleGroup = (groupName) => {
    const current = normalizeGroupSelection(studentGroups);
    const next = current.includes(groupName)
      ? current.filter((g) => g !== groupName)
      : [...current, groupName];
    setStudentGroups(next);
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
      setIsGroupsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isGroupsOpen]);

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

  const subjectName = template.subjectRelation?.name || template.subject || '';

  return createPortal(
    <div className="modal-overlay publish-bank-modal" onClick={onClose}>
      <div className="modal-content" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Выдать задание из банка</h3>
            <p className="modal-subtitle">
              Содержимое берётся из заготовки «{template.title}». Уже выданные задания не меняются.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                    onClick={() => setIsGroupsOpen((v) => !v)}
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
                            <button type="button" onClick={() => setStudentGroups([...groupOptions])}>
                              Выбрать все
                            </button>
                            <button type="button" onClick={() => setStudentGroups([])}>
                              Очистить
                            </button>
                          </div>
                          <div className="group-dropdown__list">
                            {groupOptions.map((group) => (
                              <label key={group} className="group-checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={selectedGroups.includes(group)}
                                  onChange={() => toggleGroup(group)}
                                />
                                <span>{group}</span>
                              </label>
                            ))}
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
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Создание…' : 'Выдать задание'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default PublishFromBankModal;

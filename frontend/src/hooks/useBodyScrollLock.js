import { useEffect } from 'react';

export const useBodyScrollLock = (isActive) => {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const body = document.body;
    const currentLocks = Number(body.dataset.modalLockCount || 0);
    const nextLocks = currentLocks + 1;
    body.dataset.modalLockCount = String(nextLocks);
    body.classList.add('modal-open');

    return () => {
      const activeLocks = Number(body.dataset.modalLockCount || 1) - 1;
      if (activeLocks <= 0) {
        delete body.dataset.modalLockCount;
        body.classList.remove('modal-open');
      } else {
        body.dataset.modalLockCount = String(activeLocks);
      }
    };
  }, [isActive]);
};

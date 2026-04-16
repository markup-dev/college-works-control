export const handleAdminActionResult = ({
  result,
  showSuccess,
  showError,
  successMessage = '',
  errorMessage = 'Операция не выполнена',
}) => {
  if (result?.success) {
    if (successMessage) {
      showSuccess(successMessage);
    }
    return true;
  }

  showError(result?.error || errorMessage);
  return false;
};

import { useToast } from "../Ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../Ui/toast";
import clsx from "clsx"; // for conditional classes

export function Toaster() {
  const { toasts, dismiss} = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Assign classes dynamically based on variant
        const toastClasses = clsx(
          "border-l-4 p-4 rounded-md",
          variant === "success" && "bg-green-500/10 border-green-500",
          variant === "error" && "bg-red-500/10 border-red-500",
          variant === "warning" && "bg-yellow-500/10 border-yellow-500",
          variant === "info" && "bg-blue-500/10 border-blue-500"
        );

        return (
          <Toast key={id} {...props} className={toastClasses}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose  onClick={() => dismiss(id)}/>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

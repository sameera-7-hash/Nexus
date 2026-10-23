import { toast } from 'sonner';

// One toast per action so every change gets feedback. level: ok | warn | bad | info.
export function notify(msg, level = 'ok') {
  if (level === 'bad') toast.error(msg);
  else if (level === 'warn') toast.warning(msg);
  else if (level === 'info') toast.info(msg);
  else toast.success(msg);
}

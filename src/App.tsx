import { useState } from 'react';
import { useAppStorage } from './hooks/useAppStorage';
import { MainEditor } from './components/MainEditor';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const { state, updateState, updateBehavior } = useAppStorage();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <MainEditor 
        state={state} 
        openSettings={() => setSettingsOpen(true)} 
      />
      {settingsOpen && (
        <SettingsModal 
          state={state}
          updateState={updateState}
          updateBehavior={updateBehavior}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

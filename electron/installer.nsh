!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to delete your Airbound saved career database and flight logs?$\r$\n$\r$\nLocation: $APPDATA\Airbound$\r$\n$\r$\n• Select 'Yes' to permanently remove local data.$\r$\n• Select 'No' to preserve your flight logs and career progress for future installs." IDNO skip_delete_appdata
    RMDir /r "$APPDATA\Airbound"
  skip_delete_appdata:
!macroend

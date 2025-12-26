self.addEventListener('push', function(event) {
  const options = {
    body: event.data.text(),
    icon: 'https://i.imgur.com/MNooQYo.png', 
    badge: 'https://i.imgur.com/MNooQYo.png' 
  };
  event.waitUntil(
    self.registration.showNotification('BEBEJI PLAZA Notification', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    // Canja zuwa sabon domain na BEBEJI PLAZA
    clients.openWindow('https://bebejiplaza.page.div')
  );
});
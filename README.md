# Aqtas AI School Platform

Современная AI-first платформа для школы с ролями:
- `Администратор`
- `Учитель`
- `Родитель`
- `Ученик`

В системе есть:
- дашборды по ролям
- расписание
- домашние задания
- оценки
- посещаемость
- сообщения
- объявления и события
- отчёты
- AI-помощник
- конструктор уроков
- интерактивная доска

## Быстрый запуск

### 1. Перейдите в папку проекта

```powershell
cd C:\Users\Student\Desktop\aqbobek\front
```

### 2. Установите зависимости

```powershell
npm install
```

### 3. Создайте файл `.env`

Создайте в корне проекта файл `.env` и вставьте туда:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_diary?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
NEXT_PUBLIC_APP_NAME="Aqtas Diary"
AI_PROVIDER="gemini"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
PUSHER_APP_ID=""
PUSHER_KEY=""
PUSHER_SECRET=""
PUSHER_CLUSTER="eu"
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
```

Минимально обязательно для запуска:
- `DATABASE_URL`
- `JWT_SECRET`

Для настоящего AI:
- заполните `GEMINI_API_KEY`

Для полной realtime-синхронизации доски:
- заполните `PUSHER_*`

## Настройка базы данных

Проект работает с `PostgreSQL`.

Есть 2 варианта:

### Вариант A. PostgreSQL через Docker

Если у вас установлен и запущен Docker Desktop:

```powershell
docker run --name school-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=school_diary `
  -p 5432:5432 `
  -d postgres:16
```

Тогда в `.env` оставьте:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_diary?schema=public"
```

### Вариант B. Свой PostgreSQL

Если PostgreSQL уже установлен:
- убедитесь, что он запущен
- создайте базу `school_diary`
- при необходимости измените `DATABASE_URL`

Пример:

```env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/school_diary?schema=public"
```

## Первый запуск

Выполните команды по порядку:

```powershell
npm run prisma:push
npm run db:seed
npm run dev
```

Потом откройте:

```text
http://localhost:3000
```

## Демо-аккаунты

Пароль для всех тестовых пользователей:

```text
Demo123!
```

Основные аккаунты:
- Админ: `admin@aqtas.school`
- Учитель: `teacher1@aqtas.school`
- Родитель: `parent1@aqtas.school`
- Ученик: `student1@aqtas.school`

Дополнительные аккаунты:
- Учителя: `teacher2@aqtas.school`, `teacher3@aqtas.school`
- Родители: `parent2@aqtas.school` - `parent5@aqtas.school`
- Ученики: `student2@aqtas.school` - `student10@aqtas.school`

## Полезные команды

### Разработка

```powershell
npm run dev
```

### Проверка перед показом или сдачей

```powershell
npm run lint
npm run build
```

### Prisma

```powershell
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate -- --name init
```

### Повторно заполнить демо-данные

```powershell
npm run db:seed
```

## Что можно показать в демо

После `db:seed` можно зайти под разными ролями и показать:

- разные дашборды
- создание и проверку домашки
- создание и редактирование оценок
- отметку посещаемости
- расписание и недельный обзор
- сообщения между родителями и учителями
- объявления и события
- управление пользователями, классами и расписанием
- AI-помощника
- конструктор уроков
- интерактивную доску

## Настройка AI

### Gemini

Если хотите использовать Gemini:

```env
AI_PROVIDER="gemini"
GEMINI_API_KEY="your_key_here"
GEMINI_MODEL="gemini-2.5-flash"
```

### OpenAI

Если хотите использовать OpenAI:

```env
AI_PROVIDER="openai"
OPENAI_API_KEY="your_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

### Как AI работает

- вопросы про школу используют данные из базы
- обычные вопросы вроде `что такое pi` или `что такое IELTS` идут как normal AI mode
- если ключ провайдера не указан, будут использоваться fallback-ответы

## Настройка интерактивной доски

Для полной realtime-синхронизации используется `Pusher`.

Если хотите, чтобы учитель и ученики синхронизировались в реальном времени, заполните:

```env
PUSHER_APP_ID=""
PUSHER_KEY=""
PUSHER_SECRET=""
PUSHER_CLUSTER="eu"
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
```

Если оставить их пустыми:
- приложение всё равно запускается
- страницы доски открываются
- но realtime-синхронизация будет неполной

## Структура проекта

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ai/
  forms/
  layout/
  messages/
  modules/
  providers/
  ui/
features/
  admin/
  ai/
  announcements/
  attendance/
  auth/
  calendar/
  dashboard/
  grades/
  homework/
  lessons/
  messages/
  planning/
  reports/
  schedule/
  students/
lib/
  ai/
  auth/
  permissions/
  validators/
prisma/
  schema.prisma
  seed.ts
```

## Технологии

- `Next.js 16`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `TanStack Query`
- `Zustand`
- `Prisma`
- `PostgreSQL`
- `Zod`
- `Pusher`
- `Gemini / OpenAI`

## Частые ошибки

### Ошибка: `Could not read package.json`

Вы запустили команду не в той папке.

Нужно:

```powershell
cd C:\Users\Student\Desktop\aqbobek\front
```

### Ошибка: `Can't reach database server at localhost:5432`

Значит PostgreSQL не запущен или не открыт на этом порту.

Проверьте:

```powershell
docker ps
```

Если базы нет, запустите:

```powershell
docker run --name school-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=school_diary `
  -p 5432:5432 `
  -d postgres:16
```

### Prisma работает, но приложение всё равно ругается на БД

Проверьте, что `.env` находится именно здесь:

```text
front/.env
```

А не здесь:

```text
front/,env
```

### AI отвечает шаблонно или уходит в fallback

Проверьте:
- заполнен ли `GEMINI_API_KEY` или `OPENAI_API_KEY`
- перезапустили ли вы `npm run dev` после изменения `.env`

### Доска не синхронизируется в realtime

Проверьте:
- заполнены ли все `PUSHER_*`
- вошли ли учитель и ученик в систему
- перезапустили ли приложение после изменения `.env`

## Роли

### Ученик
- видит свой дашборд
- своё расписание
- домашние задания
- оценки
- посещаемость
- AI-помощника для учёбы

### Родитель
- видит ребёнка
- оценки и посещаемость
- сообщения с учителями
- понятные AI-сводки

### Учитель
- работает со своими классами и предметами
- создаёт домашку
- ставит оценки
- отмечает посещаемость
- пользуется конструктором уроков и доской

### Администратор
- управляет пользователями
- классами
- расписанием
- событиями
- системой в целом

## Важно

- ключи AI никогда не уходят на клиент
- права ролей проверяются на backend
- демо-данные уже подготовлены для реального показа
- это полноценное full-stack приложение, а не статичный макет

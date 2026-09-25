import { app as electronApp } from 'electron';
import { app as identity } from '../config/app.js';
import { Application } from './Application.js';

electronApp.setAppUserModelId(identity.appId);

new Application(electronApp)
    .withDrivers()
    .withServices()
    .withCommands()
    .withKeyBindings()
    .configure()
    .register()
    .boot()
    .start();

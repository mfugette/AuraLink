import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VehicleEditorPageComponent } from './vehicle-editor-page.component';
import { AccountService } from '../../services/account.service';
import { SavedVehicle } from '../../models/account.model';
import { Vehicle } from '../../models/vehicle.model';

const VEHICLE: Vehicle = {
  year: 2019, make: 'Honda', model: 'Civic', subModel: null, engine: null, driveType: null,
  transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null,
};

describe('VehicleEditorPageComponent', () => {
  let fixture: ComponentFixture<VehicleEditorPageComponent>;
  let component: VehicleEditorPageComponent;
  let httpMock: HttpTestingController;

  function create(routeId: string | null) {
    TestBed.configureTestingModule({
      imports: [VehicleEditorPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(routeId ? { id: routeId } : {}) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VehicleEditorPageComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.match(() => true));

  it('add mode: isEditing is false without a route id', () => {
    create(null);
    fixture.detectChanges();
    expect(component.isEditing()).toBeFalse();
  });

  it('save() requires year, make, and model', () => {
    create(null);
    fixture.detectChanges();
    component.onVehicleChange({ ...VEHICLE, year: null });
    component.save();
    expect(component.saveError()).toBe('Year, make, and model are required.');
    expect(component.saving()).toBeFalse();
  });

  it('save() posts a new vehicle and navigates back to the garage', () => {
    create(null);
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    const account = TestBed.inject(AccountService);
    const add = spyOn(account, 'addVehicle').and.returnValue(of({} as SavedVehicle));

    fixture.detectChanges();
    component.onVehicleChange(VEHICLE);
    component.nickname.set('  Daily  ');
    component.save();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({
      nickname: 'Daily', year: 2019, make: 'Honda', model: 'Civic',
    }));
    expect(nav).toHaveBeenCalledWith(['/my-vehicles']);
  });

  it('edit mode with an unknown id bounces back to the garage', () => {
    create('missing-id');
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    TestBed.inject(AccountService).vehicles.set([
      { id: 'other', year: 2020, make: 'Ford', model: 'F-150', isPrimary: false } as never,
    ]);
    fixture.detectChanges();
    expect(nav).toHaveBeenCalledWith(['/my-vehicles']);
  });
});
